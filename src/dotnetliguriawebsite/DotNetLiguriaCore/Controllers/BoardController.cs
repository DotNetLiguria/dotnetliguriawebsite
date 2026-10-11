using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using DotNetLiguriaCore.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DotNetLiguriaCore.Controllers
{
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class BoardController(BoardService boardService, IAuthorizationService authorizationService) : ControllerBase
    {
        private readonly BoardService _boardService = boardService;

        [AllowAnonymous]
        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] bool onlyActive = false)
        {
            if (await HttpContext.IsWebDevAdminAsync(authorizationService))
            {
                return Ok(await _boardService.GetAsync(onlyActive));
            }

            var publicBoards = (await _boardService.GetAsync(onlyActive: true))
                .Select(board => new
                {
                    board.BoardId,
                    board.Name,
                    board.Description,
                    board.ProfileImageUrl,
                    board.BlogHtml,
                    board.LInkedinUrl,
                    board.TwitterUrl,
                    board.GitHubUrl,
                    board.FaceboookUrl,
                    board.InstagramUrl,
                    board.ShortBio,
                    board.FullBio,
                    board.IsActive,
                    board.Order
                });

            return Ok(publicBoards);
        }

        [AllowAnonymous]
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(Guid id)
        {
            var isAdmin = await HttpContext.IsWebDevAdminAsync(authorizationService);
            var board = await _boardService.GetAsync(id);

            if (board is null || (!isAdmin && !board.IsActive))
            {
                return NotFound();
            }

            if (isAdmin)
            {
                return Ok(board);
            }

            return Ok(new
            {
                board.BoardId,
                board.Name,
                board.Description,
                board.ProfileImageUrl,
                board.BlogHtml,
                board.LInkedinUrl,
                board.TwitterUrl,
                board.GitHubUrl,
                board.FaceboookUrl,
                board.InstagramUrl,
                board.ShortBio,
                board.FullBio,
                board.IsActive,
                board.Order
            });
        }

        [Authorize(Policy = WebDevAdminAuthorizationOptions.PolicyName)]
        [HttpPost]
        public async Task<IActionResult> Post(Board newBoard)
        {
            newBoard.BoardId = Guid.NewGuid();
            await _boardService.CreateAsync(newBoard);
            return CreatedAtAction(nameof(Get), new { id = newBoard.BoardId }, newBoard);
        }

        [Authorize(Policy = WebDevAdminAuthorizationOptions.PolicyName)]
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, Board updateBoard)
        {
            var board = await _boardService.GetAsync(id);

            if (board is null)
            {
                return NotFound();
            }

            updateBoard.BoardId = board.BoardId;

            await _boardService.UpdateAsync(id, updateBoard);

            return NoContent();
        }

        [Authorize(Policy = WebDevAdminAuthorizationOptions.PolicyName)]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var board = await _boardService.GetAsync(id);

            if (board is null)
            {
                return NotFound();
            }

            await _boardService.RemoveAsync(id);

            return NoContent();
        }

    }
}